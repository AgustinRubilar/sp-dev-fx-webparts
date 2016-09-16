import {
  BaseClientSideWebPart,
  IPropertyPaneSettings,
  PropertyPaneTextField
} from '@microsoft/sp-client-preview';

import styles from './NoFrameworkCrud.module.scss';
import * as strings from 'noFrameworkCrudStrings';
import { INoFrameworkCrudWebPartProps } from './INoFrameworkCrudWebPartProps';

interface IListItem {
  Title?: string;
  Id: number;
}

export default class NoFrameworkCrudWebPart extends BaseClientSideWebPart<INoFrameworkCrudWebPartProps> {
  private listItemEntityTypeName: string = undefined;

  public render(): void {
    this.domElement.innerHTML = `
  <div class="${styles.noFrameworkCrud}">
    <div class="${styles.container}">
      <div class="ms-Grid-row ms-bgColor-themeDark ms-fontColor-white ${styles.row}">
        <div class="ms-Grid-col ms-u-lg10 ms-u-xl8 ms-u-xlPush2 ms-u-lgPush1">
          <span class="ms-font-xl ms-fontColor-white">
            Sample SharePoint CRUD operations without any JavaScript framework
          </span>
        </div>
      </div>
      <div class="ms-Grid-row ms-bgColor-themeDark ms-fontColor-white ${styles.row}">
        <div class="ms-Grid-col ms-u-lg10 ms-u-xl8 ms-u-xlPush2 ms-u-lgPush1">
          <button class="ms-Button create-Button">
            <span class="ms-Button-label">Create item</span>
          </button>
          <button class="ms-Button read-Button">
            <span class="ms-Button-label">Read item</span>
          </button>
        </div>
      </div>
      <div class="ms-Grid-row ms-bgColor-themeDark ms-fontColor-white ${styles.row}">
        <div class="ms-Grid-col ms-u-lg10 ms-u-xl8 ms-u-xlPush2 ms-u-lgPush1">
          <button class="ms-Button readall-Button">
            <span class="ms-Button-label">Read all items</span>
          </button>
        </div>
      </div>
      <div class="ms-Grid-row ms-bgColor-themeDark ms-fontColor-white ${styles.row}">
        <div class="ms-Grid-col ms-u-lg10 ms-u-xl8 ms-u-xlPush2 ms-u-lgPush1">
          <button class="ms-Button update-Button">
            <span class="ms-Button-label">Update item</span>
          </button>
          <button class="ms-Button delete-Button">
            <span class="ms-Button-label">Delete item</span>
          </button>
        </div>
      </div>
      <div class="ms-Grid-row ms-bgColor-themeDark ms-fontColor-white ${styles.row}">
        <div class="ms-Grid-col ms-u-lg10 ms-u-xl8 ms-u-xlPush2 ms-u-lgPush1">
          <div class="status"></div>
          <ul class="items"><ul>
        </div>
      </div>
    </div>
  </div>
    `;

    this.listItemEntityTypeName = undefined;
    this.updateStatus(this.listNotConfigured() ? 'Please configure list in Web Part properties' : 'Ready');
    this.setButtonsState();
    this.setButtonsEventHandlers();
  }

  private setButtonsState(): void {
    const buttons: NodeListOf<Element> = this.domElement.querySelectorAll('button.ms-Button');
    const listNotConfigured: boolean = this.listNotConfigured();

    for (let i: number = 0; i < buttons.length; i++) {
      const button: Element = buttons.item(i);
      if (listNotConfigured) {
        button.setAttribute('disabled', 'disabled');
      }
      else {
        button.removeAttribute('disabled');
      }
    }
  }

  private setButtonsEventHandlers(): void {
    const webPart: NoFrameworkCrudWebPart = this;
    this.domElement.querySelector('button.create-Button').addEventListener('click', () => { webPart.createItem(); });
    this.domElement.querySelector('button.read-Button').addEventListener('click', () => { webPart.readItem(); });
    this.domElement.querySelector('button.readall-Button').addEventListener('click', () => { webPart.readItems(); });
    this.domElement.querySelector('button.update-Button').addEventListener('click', () => { webPart.updateItem(); });
    this.domElement.querySelector('button.delete-Button').addEventListener('click', () => { webPart.deleteItem(); });
  }

  protected get propertyPaneSettings(): IPropertyPaneSettings {
    return {
      pages: [
        {
          header: {
            description: strings.PropertyPaneDescription
          },
          groups: [
            {
              groupName: strings.DataGroupName,
              groupFields: [
                PropertyPaneTextField('listName', {
                  label: strings.ListNameFieldLabel
                })
              ]
            }
          ]
        }
      ]
    };
  }

  private listNotConfigured(): boolean {
    return this.properties.listName === undefined ||
      this.properties.listName === null ||
      this.properties.listName.length === 0;
  }

  private createItem(): void {
    this.updateStatus('Creating item...');
    this.getListItemEntityTypeName()
      .then((listItemEntityTypeName: string): Promise<Response> => {
        const body: string = JSON.stringify({
          '__metadata': {
            'type': listItemEntityTypeName
          },
          'Title': `Item ${new Date()}`
        });
        return this.context.httpClient.post(`${this.context.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${this.properties.listName}')/items`, {
          headers: {
            'Accept': 'application/json;odata=nometadata',
            'Content-type': 'application/json;odata=verbose',
            'odata-version': ''
          },
          body: body
        });
      })
      .then((response: Response): Promise<IListItem> => {
        return response.json();
      })
      .then((item: IListItem): void => {
        this.updateStatus(`Item '${item.Title}' (ID: ${item.Id}) successfully created`);
      }, (error: any): void => {
        this.updateStatus('Error while creating the item: ' + error);
      });
  }

  private readItem(): void {
    this.updateStatus('Loading latest items...');
    this.getLatestItemId()
      .then((itemId: number): Promise<Response> => {
        if (itemId === -1) {
          throw new Error('No items found in the list');
        }

        this.updateStatus(`Loading information about item ID: ${itemId}...`);
        return this.context.httpClient.get(`${this.context.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${this.properties.listName}')/items(${itemId})?$select=Title,Id`, {
          headers: {
            'Accept': 'application/json;odata=nometadata',
            'odata-version': ''
          }
        });
      })
      .then((response: Response): Promise<IListItem> => {
        return response.json();
      })
      .then((item: IListItem): void => {
        this.updateStatus(`Item ID: ${item.Id}, Title: ${item.Title}`);
      }, (error: any): void => {
        this.updateStatus('Loading latest item failed with error: ' + error);
      });
  }

  private getLatestItemId(): Promise<number> {
    return new Promise<number>((resolve: (itemId: number) => void, reject: (error: any) => void): void => {
      this.context.httpClient.get(`${this.context.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${this.properties.listName}')/items?$orderby=Id desc&$top=1&$select=id`, {
        headers: {
          'Accept': 'application/json;odata=nometadata',
          'odata-version': ''
        }
      })
        .then((response: Response): Promise<{ value: { Id: number }[] }> => {
          return response.json();
        }, (error: any): void => {
          reject(error);
        })
        .then((response: { value: { Id: number }[] }): void => {
          if (response.value.length === 0) {
            resolve(-1);
          }
          else {
            resolve(response.value[0].Id);
          }
        });
    });
  }

  private readItems(): void {
    this.updateStatus('Loading all items...');
    this.context.httpClient.get(`${this.context.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${this.properties.listName}')/items?$select=Title,Id`, {
      headers: {
        'Accept': 'application/json;odata=nometadata',
        'odata-version': ''
      }
    })
      .then((response: Response): Promise<{ value: IListItem[] }> => {
        return response.json();
      })
      .then((response: { value: IListItem[] }): void => {
        this.updateStatus(`Successfully loaded ${response.value.length} items`, response.value);
      }, (error: any): void => {
        this.updateStatus('Loading all items failed with error: ' + error);
      });
  }

  private updateItem(): void {
    this.updateStatus('Loading latest items...');
    let latestItemId: number = undefined;
    let etag: string = undefined;
    let listItemEntityTypeName: string = undefined;
    this.getListItemEntityTypeName()
      .then((listItemType: string): Promise<number> => {
        listItemEntityTypeName = listItemType;
        return this.getLatestItemId();
      })
      .then((itemId: number): Promise<Response> => {
        if (itemId === -1) {
          throw new Error('No items found in the list');
        }

        latestItemId = itemId;
        this.updateStatus(`Loading information about item ID: ${latestItemId}...`);
        return this.context.httpClient.get(`${this.context.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${this.properties.listName}')/items(${latestItemId})?$select=Id`, {
          headers: {
            'Accept': 'application/json;odata=nometadata',
            'odata-version': ''
          }
        });
      })
      .then((response: Response): Promise<IListItem> => {
        etag = response.headers.get('ETag');
        return response.json();
      })
      .then((item: IListItem): Promise<Response> => {
        this.updateStatus(`Updating item with ID: ${latestItemId}...`);
        const body: string = JSON.stringify({
          '__metadata': {
            'type': listItemEntityTypeName
          },
          'Title': `Item ${new Date()}`
        });
        return this.context.httpClient.post(`${this.context.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${this.properties.listName}')/items(${item.Id})`, {
          headers: {
            'Accept': 'application/json;odata=nometadata',
            'Content-type': 'application/json;odata=verbose',
            'odata-version': '',
            'IF-MATCH': etag,
            'X-HTTP-Method': 'MERGE'
          },
          body: body
        });
      })
      .then((response: Response): void => {
        this.updateStatus(`Item with ID: ${latestItemId} successfully updated`);
      }, (error: any): void => {
        this.updateStatus(`Error updating item: ${error}`);
      });
  }

  private deleteItem(): void {
    if (!window.confirm('Are you sure you want to delete the latest item?')) {
      return;
    }

    this.updateStatus('Loading latest items...');
    let latestItemId: number = undefined;
    let etag: string = undefined;
    this.getLatestItemId()
      .then((itemId: number): Promise<Response> => {
        if (itemId === -1) {
          throw new Error('No items found in the list');
        }

        latestItemId = itemId;
        this.updateStatus(`Loading information about item ID: ${latestItemId}...`);
        return this.context.httpClient.get(`${this.context.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${this.properties.listName}')/items(${latestItemId})?$select=Id`, {
          headers: {
            'Accept': 'application/json;odata=nometadata',
            'odata-version': ''
          }
        });
      })
      .then((response: Response): Promise<IListItem> => {
        etag = response.headers.get('ETag');
        return response.json();
      })
      .then((item: IListItem): Promise<Response> => {
        this.updateStatus(`Deleting item with ID: ${latestItemId}...`);
        return this.context.httpClient.post(`${this.context.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${this.properties.listName}')/items(${item.Id})`, {
          headers: {
            'Accept': 'application/json;odata=nometadata',
            'Content-type': 'application/json;odata=verbose',
            'odata-version': '',
            'IF-MATCH': etag,
            'X-HTTP-Method': 'DELETE'
          }
        });
      })
      .then((response: Response): void => {
        this.updateStatus(`Item with ID: ${latestItemId} successfully deleted`);
      }, (error: any): void => {
        this.updateStatus(`Error deleting item: ${error}`);
      });
  }

  private getListItemEntityTypeName(): Promise<string> {
    return new Promise<string>((resolve: (listItemEntityTypeName: string) => void, reject: (error: any) => void): void => {
      if (this.listItemEntityTypeName) {
        resolve(this.listItemEntityTypeName);
        return;
      }

      this.context.httpClient.get(`${this.context.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${this.properties.listName}')?$select=ListItemEntityTypeFullName`, {
        headers: {
          'Accept': 'application/json;odata=nometadata',
          'odata-version': ''
        }
      })
        .then((response: Response): Promise<{ ListItemEntityTypeFullName: string }> => {
          return response.json();
        }, (error: any): void => {
          reject(error);
        })
        .then((response: { ListItemEntityTypeFullName: string }): void => {
          this.listItemEntityTypeName = response.ListItemEntityTypeFullName;
          resolve(this.listItemEntityTypeName);
        });
    });
  }

  private updateStatus(status: string, items: IListItem[] = []): void {
    this.domElement.querySelector('.status').innerHTML = status;
    this.updateItemsHtml(items);
  }

  private updateItemsHtml(items: IListItem[]): void {
    const itemsHtml: string[] = [];
    for (let i: number = 0; i < items.length; i++) {
      itemsHtml.push(`<li>${items[i].Title} (${items[i].Id})</li>`);
    }

    this.domElement.querySelector('.items').innerHTML = itemsHtml.join('');
  }
}
